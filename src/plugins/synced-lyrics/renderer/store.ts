import { createMemo, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';

import { getSongInfo } from '@/providers/song-info-front';

import { config } from './renderer';

import {
  formatDurationDelta,
  makeSongKey,
  mergeSongCorrection,
  normalizeLyricResult,
} from '../helpers';
import {
  type ProviderName,
  providerNames,
  type ProviderState,
} from '../providers';
import { providers } from '../providers/renderer';

import type { LyricProvider, SearchSongInfo, SongCorrection } from '../types';
import type { SongInfo } from '@/providers/song-info';

type LyricsStore = {
  provider: ProviderName;
  current: ProviderState;
  lyrics: Record<ProviderName, ProviderState>;
};

const initialData = () =>
  providerNames.reduce(
    (acc, name) => {
      acc[name] = { state: 'fetching', data: null, error: null };
      return acc;
    },
    {} as LyricsStore['lyrics'],
  );

export const [lyricsStore, setLyricsStore] = createStore<LyricsStore>({
  provider: providerNames[0],
  lyrics: initialData(),
  get current(): ProviderState {
    return this.lyrics[this.provider];
  },
});

export const currentLyrics = createMemo(() => {
  const provider = lyricsStore.provider;
  return lyricsStore.lyrics[provider];
});

export const [currentSongInfo, setCurrentSongInfo] =
  createSignal<SongInfo | null>(null);
export const currentSongKey = createMemo(() => {
  const info = currentSongInfo();
  return info ? makeSongKey(info) : null;
});

type VideoId = string;

type SearchCacheData = Record<ProviderName, ProviderState>;
interface SearchCache {
  state: 'loading' | 'done';
  data: SearchCacheData;
}

const searchCache = new Map<VideoId, SearchCache>();
const correctionStorageKey = 'ytmd-sl-corrections';

const readCorrections = () => {
  const raw = localStorage.getItem(correctionStorageKey);
  if (!raw) {
    return {} as Record<string, SongCorrection>;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, SongCorrection>;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {} as Record<string, SongCorrection>;
  }
};

const writeCorrections = (corrections: Record<string, SongCorrection>) => {
  localStorage.setItem(correctionStorageKey, JSON.stringify(corrections));
};

export const [songCorrection, setSongCorrectionState] =
  createSignal<SongCorrection>({
    offsetMs: 0,
    updatedAt: 0,
  });

export const loadSongCorrection = (songInfo?: SearchSongInfo | null) => {
  if (!songInfo) {
    setSongCorrectionState({ offsetMs: 0, updatedAt: 0 });
    return;
  }

  const key = makeSongKey(songInfo);
  const correction = readCorrections()[key];
  setSongCorrectionState(correction ?? { offsetMs: 0, updatedAt: 0 });
};

export const saveSongCorrection = (patch: Partial<SongCorrection>) => {
  const info = currentSongInfo();
  if (!info) {
    return;
  }

  const key = makeSongKey(info);
  const corrections = readCorrections();
  const next = mergeSongCorrection(corrections[key], patch);
  corrections[key] = next;
  writeCorrections(corrections);
  setSongCorrectionState(next);
};

export const clearSongCorrectionProvider = () => {
  const info = currentSongInfo();
  if (!info) {
    return;
  }

  const key = makeSongKey(info);
  const corrections = readCorrections();
  const current = corrections[key];
  if (!current) {
    return;
  }

  const next: SongCorrection = {
    offsetMs: current.offsetMs ?? 0,
    updatedAt: Date.now(),
  };
  corrections[key] = next;
  writeCorrections(corrections);
  setSongCorrectionState(next);
};

const normalizeProviderState = (
  providerName: ProviderName,
  info: SongInfo,
  result: Awaited<ReturnType<LyricProvider['search']>>,
): ProviderState => {
  const normalized = result
    ? normalizeLyricResult(providerName, info, result)
    : null;

  if (
    normalized?.meta?.inexact &&
    config()?.showLyricsEvenIfInexact === false
  ) {
    return { state: 'done', data: null, error: null };
  }

  return {
    state: 'done',
    data: normalized,
    error: null,
  };
};

export const bestResultSummary = createMemo(() => {
  const current = currentLyrics().data?.meta;
  if (!current) {
    return null;
  }

  return {
    confidence: current.confidence,
    durationDelta: formatDurationDelta(current.durationDeltaMs),
    preview: current.preview,
  };
});

export const fetchLyrics = (info: SongInfo) => {
  setCurrentSongInfo(info);
  loadSongCorrection(info);

  if (searchCache.has(info.videoId)) {
    const cache = searchCache.get(info.videoId)!;

    if (cache.state === 'loading') {
      setTimeout(() => {
        fetchLyrics(info);
      });
      return;
    }

    if (getSongInfo().videoId === info.videoId) {
      setLyricsStore('lyrics', () => {
        return JSON.parse(JSON.stringify(cache.data)) as typeof cache.data;
      });
    }

    return;
  }

  const cache: SearchCache = {
    state: 'loading',
    data: initialData(),
  };

  searchCache.set(info.videoId, cache);
  if (getSongInfo().videoId === info.videoId) {
    setLyricsStore('lyrics', () => {
      return JSON.parse(JSON.stringify(cache.data)) as typeof cache.data;
    });
  }

  const tasks: Promise<void>[] = [];

  for (const [providerName, provider] of Object.entries(providers) as [
    ProviderName,
    LyricProvider,
  ][]) {
    const pCache = cache.data[providerName];

    tasks.push(
      provider
        .search(info)
        .then((res) => {
          const nextState = normalizeProviderState(providerName, info, res);
          cache.data[providerName] = nextState;

          if (getSongInfo().videoId === info.videoId) {
            setLyricsStore('lyrics', (old) => {
              return {
                ...old,
                [providerName]: nextState,
              };
            });
          }
        })
        .catch((error: Error) => {
          pCache.state = 'error';
          pCache.error = error;

          console.error(error);

          if (getSongInfo().videoId === info.videoId) {
            setLyricsStore('lyrics', (old) => {
              return {
                ...old,
                [providerName]: { state: 'error', error, data: null },
              };
            });
          }
        }),
    );
  }

  Promise.allSettled(tasks).then(() => {
    cache.state = 'done';
    searchCache.set(info.videoId, cache);
  });
};

export const retrySearch = (provider: ProviderName, info: SongInfo) => {
  setCurrentSongInfo(info);
  loadSongCorrection(info);

  setLyricsStore('lyrics', (old) => {
    const pCache = {
      state: 'fetching',
      data: null,
      error: null,
    };

    return {
      ...old,
      [provider]: pCache,
    };
  });

  providers[provider]
    .search(info)
    .then((res) => {
      const nextState = normalizeProviderState(provider, info, res);
      setLyricsStore('lyrics', (old) => {
        return {
          ...old,
          [provider]: nextState,
        };
      });
    })
    .catch((error) => {
      setLyricsStore('lyrics', (old) => {
        return {
          ...old,
          [provider]: { state: 'error', data: null, error },
        };
      });
    });
};
